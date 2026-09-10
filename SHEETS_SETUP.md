# Google Sheets Integration Setup

Reviews are written to a Google Sheet via an Apps Script web app. The browser
submits each review through a hidden iframe + form post, which sidesteps CORS
(the app can't read Apps Script's response cross-origin, so it doesn't try).

## 1. Create the Sheet

Put these headers in row 1:

```
Timestamp | Ticket ID | Subject | Agent | Reviewer | Correct Resolution | Tone | Followed Process | Response Time | Clarity | Total Score | Notes
```

## 2. Create the Apps Script web app

1. In the Sheet, go to **Extensions → Apps Script**
2. Paste this script:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.parameter.payload);
  sheet.appendRow([
    data.date,
    data.ticketId,
    data.subject,
    data.agentName,
    data.agentEmail,
    data.resolution,
    data.tone,
    data.process,
    data.speed,
    data.clarity,
    data.total,
    data.notes,
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Note this reads `e.parameter.payload` — the app posts the review as a single
form field named `payload` containing JSON. Adjust the `appendRow` order to
match your actual sheet columns.

## 3. Deploy

1. **Deploy → New Deployment**
2. Type: **Web App**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy and copy the Web App URL

Whenever you edit the script, deploy a **new version** — editing alone doesn't
update the live endpoint.

## 4. Add to .env

```
VITE_GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

## Known limitation

Because the submission goes through a hidden iframe, the app can't read Apps
Script's response — it treats the save as successful as soon as the iframe
loads, even if the write actually failed. If reviews ever go missing, this is
the first place to look.
