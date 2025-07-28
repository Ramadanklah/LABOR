# 📊 LDT Message Analysis & Processing Steps

## 🔍 **Message Structure Analysis**

### **Provided LDT Message:**
```
01380008230
014810000205
0199212LDT1014.01
0180201793860200
0220203Labor Potsdam
0260205Charlottenstr. 72
0180212772720053
0158300ulab12
0170101V0011271
01091064
0168312FREITAG
017910320250430
01380008218
014810000575
017831000598252
0108609K
0133101Bohr
0133102Anke
017310319630624
0193105H329268036
0193107Habichtweg
01031095
01031081
014311214469
0163113Potsdam
011311683
0184111100580002
017843220250430
0184218793860200
01042211
0184242772720053
011423927
01084031
0103110W
01086110
0128410GBB
0148410HBA1C
0118410NA
0108410K
0118410CA
0118410HN
0138410KREA
0138410ALAT
0138410ASAT
0128410GGT
0158410GLUCEX
0128410CRP
0128410TSH
0158410VITB12
0259901LOCATION|Potsdam
0589901*IMAGENAME\\172.16.70.245\la\scanner\00598252.tif
01380008231
014810000044
017920200000824
```

## 📋 **Record Analysis**

### **Header Records (8000 series):**
- `01380008230` - Header record (length: 13, type: 8000, field: 8230)
- `01380008231` - Header record (length: 13, type: 8000, field: 8231)

### **Practice/Lab Identification (8100 series):**
- `014810000205` - Practice identification (length: 14, type: 8100, field: 0020, content: 5)
- `014810000575` - Practice identification (length: 14, type: 8100, field: 0057, content: 5)

### **Software Information (9200 series):**
- `0199212LDT1014.01` - Software version (length: 19, type: 9212, field: LDT1, content: 014.01)

### **Lab Information (0200 series):**
- `0180201793860200` - Lab BSNR (length: 18, type: 0201, field: 7981, content: 93860200)
- `0180212772720053` - Lab LANR (length: 18, type: 0212, field: 7733, content: 72720053)

### **Lab Details (0200 series):**
- `0220203Labor Potsdam` - Lab name (length: 22, type: 0203, field: 0203, content: Labor Potsdam)
- `0260205Charlottenstr. 72` - Lab address (length: 26, type: 0205, field: 0205, content: Charlottenstr. 72)

### **Request Information (8300 series):**
- `0158300ulab12` - Request ID (length: 15, type: 8300, field: 8300, content: ulab12)
- `0170101V0011271` - Request type (length: 17, type: 0101, field: V001, content: 1271)

### **Patient Information (3100 series):**
- `0133101Bohr` - Patient last name (length: 13, type: 3101, field: 3101, content: Bohr)
- `0133102Anke` - Patient first name (length: 13, type: 3102, field: 3102, content: Anke)
- `017310319630624` - Patient birth date (length: 17, type: 3103, field: 3103, content: 19630624)
- `0193105H329268036` - Patient ID (length: 19, type: 3105, field: 3105, content: H329268036)
- `0193107Habichtweg` - Patient address (length: 19, type: 3107, field: 3107, content: Habichtweg)
- `01031095` - Patient gender (length: 10, type: 3109, field: 3109, content: 5)
- `01031081` - Patient age (length: 10, type: 3108, field: 3108, content: 1)
- `014311214469` - Patient postal code (length: 14, type: 3112, field: 3112, content: 14469)
- `0163113Potsdam` - Patient city (length: 16, type: 3113, field: 3113, content: Potsdam)
- `011311683` - Patient phone (length: 11, type: 3116, field: 3116, content: 83)

### **Test Results (8400 series):**
- `0184111100580002` - Test result (length: 18, type: 4111, field: 4111, content: 00580002)
- `017843220250430` - Test date (length: 17, type: 8432, field: 8432, content: 20250430)
- `0184218793860200` - Test BSNR (length: 18, type: 4218, field: 7981, content: 93860200)
- `01042211` - Test status (length: 10, type: 4221, field: 4221, content: 1)
- `0184242772720053` - Test LANR (length: 18, type: 4242, field: 7733, content: 72720053)
- `011423927` - Test number (length: 11, type: 4239, field: 4239, content: 27)

### **Laboratory Tests (8400 series):**
- `01084031` - Test type (length: 10, type: 8403, field: 8403, content: 1)
- `0103110W` - Test parameter (length: 10, type: 3110, field: 3110, content: W)
- `01086110` - Test value (length: 10, type: 8611, field: 8611, content: 0)

### **Test Parameters:**
- `0128410GBB` - Blood count (length: 12, type: 8410, field: GBB, content: )
- `0148410HBA1C` - HbA1c (length: 14, type: 8410, field: HBA1, content: C)
- `0118410NA` - Sodium (length: 11, type: 8410, field: NA, content: )
- `0108410K` - Potassium (length: 10, type: 8410, field: K, content: )
- `0118410CA` - Calcium (length: 11, type: 8410, field: CA, content: )
- `0118410HN` - Hemoglobin (length: 11, type: 8410, field: HN, content: )
- `0138410KREA` - Creatinine (length: 13, type: 8410, field: KREA, content: )
- `0138410ALAT` - ALT (length: 13, type: 8410, field: ALAT, content: )
- `0138410ASAT` - AST (length: 13, type: 8410, field: ASAT, content: )
- `0128410GGT` - GGT (length: 12, type: 8410, field: GGT, content: )
- `0158410GLUCEX` - Glucose (length: 15, type: 8410, field: GLUC, content: EX)
- `0128410CRP` - CRP (length: 12, type: 8410, field: CRP, content: )
- `0128410TSH` - TSH (length: 12, type: 8410, field: TSH, content: )
- `0158410VITB12` - Vitamin B12 (length: 15, type: 8410, field: VITB, content: 12)

### **Additional Information (9900 series):**
- `0259901LOCATION|Potsdam` - Location info (length: 25, type: 9901, field: 9901, content: LOCATION|Potsdam)
- `0589901*IMAGENAME\\172.16.70.245\la\scanner\00598252.tif` - Image path (length: 58, type: 9901, field: *IMA, content: GE\\172.16.70.245\la\scanner\00598252.tif)

## 🔑 **Key Identifiers Extracted**

### **BSNR (Betriebsstättennummer):**
- **Primary**: `93860200` (from record `0180201793860200`)
- **Secondary**: `93860200` (from record `0184218793860200`)

### **LANR (Länderarztnummer):**
- **Primary**: `72720053` (from record `0180212772720053`)
- **Secondary**: `72720053` (from record `0184242772720053`)

### **Patient Information:**
- **Name**: Anke Bohr
- **Birth Date**: 1963-06-24
- **Patient ID**: H329268036
- **Address**: Habichtweg, 14469 Potsdam

### **Lab Information:**
- **Lab Name**: Labor Potsdam
- **Lab Address**: Charlottenstr. 72
- **Request ID**: ulab12
- **Test Date**: 2025-04-30

## 🧪 **Test Results Summary**

### **Laboratory Tests Performed:**
1. **Blood Count** (GBB)
2. **HbA1c** (HBA1C)
3. **Sodium** (NA)
4. **Potassium** (K)
5. **Calcium** (CA)
6. **Hemoglobin** (HN)
7. **Creatinine** (KREA)
8. **ALT** (ALAT)
9. **AST** (ASAT)
10. **GGT** (GGT)
11. **Glucose** (GLUCEX)
12. **CRP** (CRP)
13. **TSH** (TSH)
14. **Vitamin B12** (VITB12)

## 📊 **Processing Requirements**

### **For User Matching:**
- **BSNR**: `93860200`
- **LANR**: `72720053`
- **Patient**: Anke Bohr (H329268036)

### **For Result Creation:**
- **Test Type**: Comprehensive laboratory panel
- **Test Date**: 2025-04-30
- **Lab**: Labor Potsdam
- **Request ID**: ulab12
- **Image Path**: Available for PDF generation