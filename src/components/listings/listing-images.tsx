'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ListingImagesProps {
  images: string[];
  title: string;
}

export function ListingImages({ images, title }: ListingImagesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden rounded-xl bg-muted mb-6">
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-muted-foreground">No images available</span>
        </div>
      </div>
    );
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const previousImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="mb-6">
      {/* Main Image */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden rounded-xl bg-muted mb-4">
        <Image
          src={images[currentIndex]}
          alt={`${title} - Image ${currentIndex + 1}`}
          fill
          className="object-cover"
          priority
        />

        {/* Navigation Arrows (only show if more than 1 image) */}
        {images.length > 1 && (
          <>
            <button
              onClick={previousImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Image Counter */}
            <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail Grid (only show if more than 1 image) */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
          {images.slice(0, 6).map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`relative aspect-square overflow-hidden rounded-lg ${
                currentIndex === index
                  ? 'ring-2 ring-primary'
                  : 'ring-1 ring-border hover:ring-primary/50'
              } transition-all`}
            >
              <Image
                src={image}
                alt={`${title} thumbnail ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 25vw, 16vw"
              />
            </button>
          ))}
          {images.length > 6 && (
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted flex items-center justify-center">
              <span className="text-sm text-muted-foreground font-medium">
                +{images.length - 6}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
