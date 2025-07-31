import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from './ui/Card'
import Button from './ui/Button'
import Badge from './ui/Badge'
import { 
  ChartBarIcon, 
  DocumentTextIcon, 
  UserGroupIcon, 
  ClockIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  DownloadIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

const Dashboard = ({ currentUser, results, onViewChange }) => {
  const [stats, setStats] = useState({
    totalResults: 0,
    pendingResults: 0,
    completedResults: 0,
    recentActivity: 0
  })

  const [chartData, setChartData] = useState([])
  const [recentResults, setRecentResults] = useState([])

  useEffect(() => {
    if (results) {
      const total = results.length
      const pending = results.filter(r => r.status === 'Pending').length
      const completed = results.filter(r => r.status === 'Final').length
      const recent = results.filter(r => {
        const resultDate = new Date(r.date)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return resultDate >= weekAgo
      }).length

      setStats({ totalResults: total, pendingResults: pending, completedResults: completed, recentActivity: recent })

      // Prepare chart data
      const monthlyData = results.reduce((acc, result) => {
        const month = format(new Date(result.date), 'MMM')
        acc[month] = (acc[month] || 0) + 1
        return acc
      }, {})

      const chartDataArray = Object.entries(monthlyData).map(([month, count]) => ({
        month,
        count
      }))

      setChartData(chartDataArray)
      setRecentResults(results.slice(0, 5))
    }
  }, [results])

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = 'primary' }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">{title}</p>
              <p className="text-2xl font-bold text-secondary-900">{value}</p>
              {trend && (
                <div className="flex items-center mt-2">
                  {trend === 'up' ? (
                    <ArrowUpIcon className="h-4 w-4 text-success-500 mr-1" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4 text-danger-500 mr-1" />
                  )}
                  <span className={`text-sm ${trend === 'up' ? 'text-success-600' : 'text-danger-600'}`}>
                    {trendValue}%
                  </span>
                </div>
              )}
            </div>
            <div className={`p-3 rounded-full bg-${color}-100`}>
              <Icon className={`h-6 w-6 text-${color}-600`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  const QuickAction = ({ title, description, icon: Icon, onClick, variant = 'primary' }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className="cursor-pointer hover:shadow-medium transition-shadow duration-200" onClick={onClick}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full bg-${variant}-100`}>
              <Icon className={`h-6 w-6 text-${variant}-600`} />
            </div>
            <div>
              <h3 className="font-semibold text-secondary-900">{title}</h3>
              <p className="text-sm text-secondary-600">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Dashboard</h1>
          <p className="text-secondary-600">Welcome back, {currentUser?.email}</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => onViewChange('dashboard')}>
            <EyeIcon className="h-4 w-4 mr-2" />
            View All Results
          </Button>
          <Button onClick={() => onViewChange('upload')}>
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            Upload Results
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Results"
          value={stats.totalResults}
          icon={DocumentTextIcon}
          trend="up"
          trendValue={12}
          color="primary"
        />
        <StatCard
          title="Pending Results"
          value={stats.pendingResults}
          icon={ClockIcon}
          color="warning"
        />
        <StatCard
          title="Completed Results"
          value={stats.completedResults}
          icon={ChartBarIcon}
          trend="up"
          trendValue={8}
          color="success"
        />
        <StatCard
          title="Recent Activity"
          value={stats.recentActivity}
          icon={UserGroupIcon}
          color="secondary"
        />
      </div>

      {/* Charts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Results Chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Results Overview</CardTitle>
              <CardDescription>Monthly results distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-secondary-900">Quick Actions</h3>
          <QuickAction
            title="View Results"
            description="Browse all laboratory results"
            icon={EyeIcon}
            onClick={() => onViewChange('dashboard')}
            variant="primary"
          />
          <QuickAction
            title="Download Reports"
            description="Export results as PDF"
            icon={DownloadIcon}
            onClick={() => onViewChange('download')}
            variant="success"
          />
          {currentUser?.role === 'admin' && (
            <QuickAction
              title="User Management"
              description="Manage system users"
              icon={UserGroupIcon}
              onClick={() => onViewChange('users')}
              variant="secondary"
            />
          )}
        </div>
      </div>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
          <CardDescription>Latest laboratory results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentResults.map((result, index) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-primary-100 rounded-full">
                    <DocumentTextIcon className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-secondary-900">{result.patient}</h4>
                    <p className="text-sm text-secondary-600">{result.type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={result.status === 'Final' ? 'success' : 'warning'}
                  >
                    {result.status}
                  </Badge>
                  <span className="text-sm text-secondary-500">
                    {format(new Date(result.date), 'MMM dd, yyyy')}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard