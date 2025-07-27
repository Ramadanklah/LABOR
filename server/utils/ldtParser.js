const COLUMN_REGEX = /<column1>(.*?)<\/column1>/g;

/**
 * Lightweight parser for incoming LDT XML payloads from Mirth-Connect.
 * It extracts every <column1>value</column1> item and breaks the value
 * into the four standard parts used by the LDTGenerator so the inbound
 * and outbound formats stay symmetrical.
 *
 * length   – first 3 chars  (total record length including prefix)
 * type     – next 4 chars   (record type e.g. 8000, 8100 …)
 * fieldId  – next 4 chars   (field identifier e.g. 9218, 7260 …)
 * content  – remainder      (actual payload)
 *
 * The function returns an array of objects: [{ raw, length, recordType,
 * fieldId, content }]
 *
 * NOTE: This is NOT a full LDT validator – it only does the absolute
 * minimum that is required for storing the message. If you need strict
 * validation you should integrate a dedicated LDT library later.
 *
 * @param {string} xmlString – raw XML payload as received via HTTP POST
 * @returns {Array<{raw:string,length:string,recordType:string,fieldId:string,content:string}>}
 */
function parseLDT(xmlString = '') {
  if (typeof xmlString !== 'string' || !xmlString.trim()) {
    return [];
  }

  const records = [];
  const iterator = xmlString.matchAll(COLUMN_REGEX);

  for (const match of iterator) {
    const raw = match[1] || '';
    if (!raw) continue;
    const length = raw.slice(0, 3);
    const recordType = raw.slice(3, 7);
    const fieldId = raw.slice(7, 11);
    const content = raw.slice(11);

    records.push({ raw, length, recordType, fieldId, content });
  }

  return records;
}

module.exports = parseLDT;