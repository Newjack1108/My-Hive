import { useState, useEffect } from 'react';

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export default function AuthenticatedImage({ src, alt, className, loading = 'lazy' }: AuthenticatedImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        // Get the full URL
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const fullUrl = baseUrl + src;

        // Fetch with authentication
        const token = localStorage.getItem('token');
        const response = await fetch(fullUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load image');
        }

        // Convert to blob and create object URL
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setError(false);
      } catch (err) {
        console.error('Error loading authenticated image:', err);
        setError(true);
      }
    };

    loadImage();

    // Cleanup: revoke object URL when component unmounts or src changes
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (error) {
    return (
      <div className={className} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        color: '#999',
        fontSize: '0.875rem'
      }}>
        Failed to load
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className={className} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        color: '#999',
        fontSize: '0.875rem'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      loading={loading}
    />
  );
}
