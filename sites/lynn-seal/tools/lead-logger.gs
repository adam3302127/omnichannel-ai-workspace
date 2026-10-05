// Google Apps Script: free lead log to a Google Sheet.
// 1. In Google Drive, create a Sheet named "Lynn Seal Leads" with a header row:
//    timestamp, name, email, phone, interest, timeframe, listing, address, message, source, page
// 2. Extensions > Apps Script. Paste this file. Deploy > New deployment > Web app,
//    execute as Me, access Anyone. Copy the web app URL.
// 3. Put that URL in data/site.json as leadLogEndpoint and run `node build.js`.
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var d = JSON.parse(e.postData.contents || '{}');
  sheet.appendRow([new Date(), d.name || '', d.email || '', d.phone || '', d.interest || '',
    d.timeframe || '', d.listing || '', d.address || '', d.message || '', d.source || '', d.page || '']);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
