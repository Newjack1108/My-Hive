import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    // Log detailed error information
    console.error('Error handler:', {
        message: err?.message,
        code: err?.code,
        detail: err?.detail,
        hint: err?.hint,
        name: err?.name,
        stack: err?.stack,
        path: req.path,
        method: req.method
    });

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

    // Handle missing table error (42P01)
    if (err.code === '42P01') {
        console.error('Database table does not exist. Run migrations: npm run db:migrate');
        return res.status(500).json({
            error: 'Database schema error',
            message: 'Required database table is missing. Please run database migrations.',
            code: err.code
        });
    }

    const statusCode = err.status || err.http_code || 500;
    const errorMessage = err.message || 'Internal server error';
    
    // Include more details in development
    const response: any = {
        error: errorMessage,
    };
    
    // Include error code for database errors
    if (err.code) {
        response.code = err.code;
    }
    
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.stack = err.stack;
    }
    
    res.status(statusCode).json(response);
}
