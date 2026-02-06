import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';

const router = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Upload endpoint - handles multiple files
router.post('/', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const customNames = req.body.customNames;
    const customNamesArray = Array.isArray(customNames) ? customNames : [customNames].filter(Boolean);

    // Create exam records for each uploaded file (without parsing)
    const results = await Promise.all(
      files.map(async (file, index) => {
        // Get filename without extension
        const filenameWithoutExt = path.parse(file.originalname).name;
        
        // Use custom name if provided, otherwise use filename without extension
        const displayName = customNamesArray[index] || filenameWithoutExt;
        
        // Create exam record without parsing
        const fileUrl = `/uploads/${file.filename}`;
        const exam = await prisma.exam.create({
          data: {
            url: fileUrl,
            name: displayName,
            subject: 'Unknown', // Will be updated when parsed
            parsed: false,
          }
        });
        
        return {
          id: exam.id,
          filename: displayName,
          path: fileUrl,
          size: file.size,
          parsed: false,
        };
      })
    );

    res.json({
      success: true,
      message: `${files.length} file(s) uploaded successfully`,
      exams: results,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
