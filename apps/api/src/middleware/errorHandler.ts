import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    console.error('Error:', err);

    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'Validation error',
            details: err.errors,
        });
    }

    if (err.code === '23505') { // Unique violation
        return res.status(409).json({
            error: 'Duplicate entry',
            message: err.detail,
        });
    }

    if (err.code === '23503') { // Foreign key violation
        return res.status(400).json({
            error: 'Invalid reference',
            message: err.detail,
        });
    }

    const statusCode = err.status || err.http_code || 500;
    const errorMessage = err.message || 'Internal server error';
    
    // Include more details in development
    const response: any = {
        error: errorMessage,
    };
    
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.stack = err.stack;
    }
    
    res.status(statusCode).json(response);
}
