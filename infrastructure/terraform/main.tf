terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
  backend "s3" {
    bucket = "labor-saas-terraform-state"
    key    = "production/terraform.tfstate"
    region = "eu-west-1"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "labor-saas"
      ManagedBy   = "terraform"
    }
  }
}

# VPC and Networking
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "labor-saas-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = var.environment
  }
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "labor-saas-cluster"
  cluster_version = "1.28"

  cluster_endpoint_public_access = true
  cluster_endpoint_private_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      desired_capacity = 2
      min_capacity     = 1
      max_capacity     = 5

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"

      labels = {
        Environment = var.environment
        NodeGroup   = "general"
      }

      tags = {
        ExtraTag = "eks-node-group"
      }
    }
  }

  tags = {
    Environment = var.environment
  }
}

# RDS PostgreSQL
resource "aws_db_subnet_group" "postgres" {
  name       = "labor-saas-postgres-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "labor-saas-postgres-subnet-group"
  }
}

resource "aws_security_group" "postgres" {
  name_prefix = "labor-saas-postgres-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "labor-saas-postgres-sg"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "labor-saas-postgres"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = "labor_saas"
  username = "labor_admin"
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.postgres.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot = false
  final_snapshot_identifier = "labor-saas-postgres-final-snapshot"

  deletion_protection = true

  tags = {
    Name = "labor-saas-postgres"
  }
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "redis" {
  name       = "labor-saas-redis-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name_prefix = "labor-saas-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "labor-saas-redis-sg"
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "labor-saas-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  security_group_ids   = [aws_security_group.redis.id]
  subnet_group_name    = aws_elasticache_subnet_group.redis.name

  tags = {
    Name = "labor-saas-redis"
  }
}

# S3 for file storage
resource "aws_s3_bucket" "labor_files" {
  bucket = "labor-saas-files-${random_string.bucket_suffix.result}"

  tags = {
    Name = "labor-saas-files"
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket_versioning" "labor_files" {
  bucket = aws_s3_bucket.labor_files.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "labor_files" {
  bucket = aws_s3_bucket.labor_files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "labor_files" {
  bucket = aws_s3_bucket.labor_files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "labor_files" {
  bucket = aws_s3_bucket.labor_files.id

  rule {
    id     = "transition_to_ia"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555  # 7 years
    }
  }
}

# Application Load Balancer
resource "aws_lb" "labor" {
  name               = "labor-saas-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = true

  tags = {
    Name = "labor-saas-alb"
  }
}

resource "aws_security_group" "alb" {
  name_prefix = "labor-saas-alb-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "labor-saas-alb-sg"
  }
}

resource "aws_lb_target_group" "labor" {
  name     = "labor-saas-tg"
  port     = 5000
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "labor_http" {
  load_balancer_arn = aws_lb.labor.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "labor_https" {
  load_balancer_arn = aws_lb.labor.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.labor.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.labor.arn
  }
}

# ACM Certificate
resource "aws_acm_certificate" "labor" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Route53 DNS
resource "aws_route53_zone" "labor" {
  name = var.domain_name
}

resource "aws_route53_record" "labor" {
  zone_id = aws_route53_zone.labor.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.labor.dns_name
    zone_id                = aws_lb.labor.zone_id
    evaluate_target_health = true
  }
}

# AWS Secrets Manager for application secrets
resource "aws_secretsmanager_secret" "labor_secrets" {
  name = "labor-saas-secrets"
  
  tags = {
    Name = "labor-saas-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "labor_secrets" {
  secret_id = aws_secretsmanager_secret.labor_secrets.id
  secret_string = jsonencode({
    JWT_SECRET = var.jwt_secret
    DB_PASSWORD = var.db_password
    REDIS_PASSWORD = var.redis_password
    MIRTH_WEBHOOK_SECRET = var.mirth_webhook_secret
  })
}

# Outputs
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_iam_role_name" {
  description = "IAM role name associated with EKS cluster"
  value       = module.eks.cluster_iam_role_name
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
}

output "postgres_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes.0.address
}

output "s3_bucket_name" {
  description = "S3 bucket name for file storage"
  value       = aws_s3_bucket.labor_files.bucket
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.labor.dns_name
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}