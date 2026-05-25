const fs = require('fs');
const db = require('../config/db');
const aiService = require('../services/aiService');
const { getLabels, deleteHistory } = require('../controllers/diagnoseController');

// Jest Mocking
jest.mock('fs');
jest.mock('../config/db');
jest.mock('../services/aiService');

// Asenkron fs.promises metotlarını taklit et (mock)
fs.promises = {
    access: jest.fn(),
    unlink: jest.fn(),
    copyFile: jest.fn(),
    writeFile: jest.fn()
};

describe('Diagnose Controller Unit Tests (TDD)', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        fs.promises.access.mockResolvedValue(true);
        fs.promises.unlink.mockResolvedValue(true);
        fs.promises.copyFile.mockResolvedValue(true);
        fs.promises.writeFile.mockResolvedValue(true);
        
        req = {
            params: {},
            body: {},
            file: null
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    describe('getLabels', () => {
        it('should return supported labels successfully (Happy Path)', () => {
            const mockLabels = ['apple', 'cherry', 'corn'];
            aiService.getLabels.mockReturnValue(mockLabels);

            getLabels(req, res);

            expect(aiService.getLabels).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                basarili: true,
                toplamTur: 3,
                bitkiTurleri: mockLabels,
                not: expect.any(String)
            });
        });

        it('should handle errors when getLabels throws an exception', () => {
            aiService.getLabels.mockImplementation(() => {
                throw new Error('Service failure');
            });

            getLabels(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                basarili: false,
                hata: 'Bitki listesi alınamadı.'
            });
        });
    });

    describe('deleteHistory (TDD target)', () => {
        it('should successfully delete history and return the deleted ID as silinen_id [HAPPY PATH]', async () => {
            req.params.id = '12';

            // Mock DB responses
            db.query
                // First query: SELECT resim_yolu
                .mockResolvedValueOnce({
                    rowCount: 1,
                    rows: [{ resim_yolu: 'img_test.jpg' }]
                })
                // Second query: DELETE
                .mockResolvedValueOnce({
                    rowCount: 1
                });

            // Mock fs helper
            fs.promises.access.mockResolvedValueOnce(true);
            fs.promises.unlink.mockResolvedValueOnce(true);

            await deleteHistory(req, res);

            // Verifications
            expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('SELECT resim_yolu'), ['12']);
            expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE'), ['12']);
            expect(fs.promises.unlink).toHaveBeenCalled();

            expect(res.json).toHaveBeenCalledWith({
                basarili: true,
                mesaj: 'Teşhis kaydı ve ilişkili görsel başarıyla silindi.',
                silinen_id: '12'
            });
        });

        it('should return 404 and include talep_edilen_id when the record does not exist [RED PHASE - EDGE CASE]', async () => {
            req.params.id = '999';

            // Mock DB responses: SELECT returns rowCount = 0 (record not found)
            db.query.mockResolvedValueOnce({
                rowCount: 0,
                rows: []
            });

            await deleteHistory(req, res);

            // Verifications
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT resim_yolu'), ['999']);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                basarili: false,
                hata: 'Silinmek istenen kayıt bulunamadı.',
                talep_edilen_id: '999'
            });
        });
    });
});
