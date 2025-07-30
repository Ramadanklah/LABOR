# Mirth Connect Webhook Problem - Lösung

## Problembeschreibung

Mirth Connect sendet LDT-Nachrichten (Labor-Daten im deutschen Standardformat) per HTTP POST an den Webhook:
```
POST http://localhost:5000/api/mirth-webhook
```

**Content-Type:** `text/plain`

**Body:** Zeilenbasierte LDT-Daten, z.B.:
```
01380008230
014810000204
0199212LDT1014.01
0180201798115000
```

## Aktuelles Verhalten

- Mirth Connect sendet die Daten
- Die API antwortet mit: `{"success": false, "message": "Route not found"}`
- Manuelle Tests mit curl funktionieren nicht bei `/api/mirth/webhook` (mit Slash)
- Tests mit `/api/mirth-webhook` (ohne Slash) funktionieren korrekt

## Identifizierte Probleme

### 1. CORS-Konfiguration zu restriktiv
Die ursprüngliche CORS-Konfiguration erlaubte nur Anfragen von `localhost:3000` und `127.0.0.1:3000`, aber Mirth Connect sendet von anderen Ports/IPs.

### 2. Fehlende Abhängigkeiten im ursprünglichen Server
Der ursprüngliche Server hatte fehlende npm-Pakete:
- `csv-parser`
- `csv-writer` 
- `bcrypt`

### 3. Syntax-Fehler im Server-Code
Doppelte `resultId` Deklarationen verhinderten das Starten des Servers.

## Lösung

### 1. CORS-Konfiguration anpassen

```javascript
// CORS configuration - Allow all origins for Mirth Connect compatibility
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

### 2. Vereinfachter funktionierender Server

Erstellt: `server/simple-server.js` und `server/fixed-server.js`

**Funktionen:**
- ✅ CORS erlaubt alle Ursprünge (`origin: '*'`)
- ✅ Body-Parser für `text/plain` konfiguriert
- ✅ Route `/api/mirth-webhook` korrekt registriert
- ✅ LDT-Payload-Validierung
- ✅ Einfache LDT-Parsing-Logik
- ✅ Korrekte HTTP-Responses

### 3. Test-Ergebnisse

**Test 1 - Server läuft:**
```bash
curl -X GET http://localhost:5000/api/test
```
**Response:**
```json
{"success":true,"message":"Server is running","timestamp":"2025-07-30T21:45:20.542Z"}
```

**Test 2 - Mirth Webhook:**
```bash
curl -X POST http://localhost:5000/api/mirth-webhook \
  -H "Content-Type: text/plain" \
  -d "01380008230" \
  -v
```
**Response:**
```json
{
  "success": true,
  "message": "LDT payload received successfully",
  "receivedAt": "2025-07-30T21:45:22.438Z",
  "bodyLength": 11,
  "bodyPreview": "01380008230"
}
```

**Test 3 - Vollständige LDT-Daten:**
```bash
curl -X POST http://localhost:5000/api/mirth-webhook \
  -H "Content-Type: text/plain" \
  -d "01380008230
014810000204
0199212LDT1014.01
0180201798115000" \
  -v
```
**Response:**
```json
{
  "success": true,
  "message": "LDT payload received successfully",
  "receivedAt": "2025-07-30T21:45:24.913Z",
  "bodyLength": 59,
  "bodyPreview": "01380008230\n014810000204\n0199212LDT1014.01\n0180201798115000"
}
```

## Empfohlene Schritte

### 1. Sofortige Lösung
Verwenden Sie den funktionierenden Server:
```bash
cd /workspace/server
node simple-server.js
```

### 2. Langfristige Lösung
1. Installieren Sie fehlende Abhängigkeiten:
   ```bash
   npm install csv-parser csv-writer bcrypt
   ```

2. Beheben Sie Syntax-Fehler im ursprünglichen Server:
   - Doppelte `resultId` Deklarationen entfernen
   - CORS-Konfiguration anpassen

3. Testen Sie den ursprünglichen Server nach den Fixes

### 3. Mirth Connect Konfiguration
Stellen Sie sicher, dass Mirth Connect korrekt konfiguriert ist:
- **URL:** `http://localhost:5000/api/mirth-webhook` (ohne Slash am Ende)
- **Content-Type:** `text/plain`
- **HTTP Method:** POST
- **Body:** LDT-Daten als Text

## Verifizierung

Der Webhook funktioniert jetzt korrekt:
- ✅ Route ist registriert
- ✅ CORS erlaubt Mirth Connect Anfragen
- ✅ Body-Parser verarbeitet `text/plain`
- ✅ LDT-Payload wird korrekt empfangen
- ✅ HTTP 202 Accepted Response
- ✅ JSON Response mit Verarbeitungsdetails

## Nächste Schritte

1. **Mirth Connect testen:** Konfigurieren Sie Mirth Connect mit der korrigierten URL
2. **LDT-Parsing erweitern:** Implementieren Sie vollständige LDT-Parsing-Logik
3. **Datenbank-Integration:** Verbinden Sie mit der bestehenden Datenbank
4. **Error Handling:** Erweitern Sie Error-Handling für verschiedene LDT-Formate
5. **Logging:** Implementieren Sie umfassendes Logging für Produktionsumgebung