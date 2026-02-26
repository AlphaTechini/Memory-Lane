import { PDFParse as pdfParse } from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extracts plain text from a file buffer based on its mimetype
 * @param {Buffer} fileBuffer - The buffer of the uploaded file
 * @param {string} mimetype - The mimetype of the file
 * @returns {Promise<string>} - The extracted plain text
 */
export async function extractTextFromFile(fileBuffer, mimetype) {
    try {
        if (mimetype === 'application/pdf') {
            const data = await pdfParse(fileBuffer);
            return data.text || '';
        }
        else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mimetype === 'application/msword'
        ) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            return result.value || '';
        }
        else if (mimetype.startsWith('text/')) {
            return fileBuffer.toString('utf-8');
        }
        else {
            throw new Error(`Unsupported file type: ${mimetype}. Only PDF, DOCX, and TXT are supported.`);
        }
    } catch (error) {
        console.error('Error extracting text from file:', error);
        throw new Error(`Failed to extract text: ${error.message}`);
    }
}
