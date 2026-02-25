import mongoose from 'mongoose';

const journalSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 150
    },
    extractedText: {
        type: String,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for faster queries
journalSchema.index({ patientId: 1, createdAt: -1 });

export const Journal = mongoose.model('Journal', journalSchema);
export default Journal;
