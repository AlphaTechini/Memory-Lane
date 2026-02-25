import { authenticateToken } from '../middleware/auth.js';
import Journal from '../models/Journal.js';
import { extractTextFromFile } from '../utils/fileExtractor.js';
import { storeMemory } from '../services/ragClient.js';
import logger from '../utils/logger.js';

export default async function journalRoutes(fastify, options) {

    /**
     * Fetch all journals for the authenticated patient/user
     */
    fastify.get('/api/journals', { preHandler: [authenticateToken] }, async (request, reply) => {
        try {
            const patientId = request.user.id;
            const journals = await Journal.find({ patientId }).sort({ createdAt: -1 });

            return reply.send({ success: true, journals });
        } catch (error) {
            logger.error('Error fetching journals:', error);
            return reply.status(500).send({ success: false, message: 'Failed to fetch journals', error: error.message });
        }
    });

    /**
     * Upload and process a new journal (PDF, DOCX, TXT)
     */
    fastify.post('/api/journals/upload', { preHandler: [authenticateToken] }, async (request, reply) => {
        try {
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ success: false, message: 'No file uploaded' });
            }

            // Buffer the file
            const fileBuffer = await data.toBuffer();
            const mimetype = data.mimetype;
            const filename = data.filename;

            // Ensure user ID is present
            const patientId = request.user.id;

            // Optionally extract title from multipart fields or fallback to filename
            const titleField = data.fields?.title;
            let title = filename;
            if (titleField && titleField.value) {
                title = titleField.value;
            }

            // Step 1: Extract Text
            const extractedText = await extractTextFromFile(fileBuffer, mimetype);
            if (!extractedText || extractedText.trim().length === 0) {
                return reply.status(400).send({ success: false, message: 'Could not extract text from the provided file.' });
            }

            // Step 2: Save to MongoDB
            const journalEntry = new Journal({
                patientId,
                title,
                extractedText,
                filename
            });
            await journalEntry.save();

            // Step 3: Inject into RAG Engine (Sensay/Groq backend)
            // Call ragClient.storeMemory (user_id, content, importance, source, session_id, replica_id)
            // Journals are specific to the User, importance is somewhat high since it's a journal.
            const ramResult = await storeMemory(patientId, extractedText, 0.8, 'file', '', '');

            if (!ramResult.success) {
                logger.warn(`Journal saved to Mongo, but RAG injection failed: ${ramResult.error}`);
            }

            return reply.send({
                success: true,
                message: 'Journal uploaded and processed successfully',
                journal: journalEntry,
                ragInjected: ramResult.success
            });

        } catch (error) {
            logger.error('Error processing journal upload:', error);
            return reply.status(500).send({ success: false, message: 'Failed to upload journal', error: error.message });
        }
    });
}
