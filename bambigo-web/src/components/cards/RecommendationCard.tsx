import Image from 'next/image';
import { Star, MapPin, Clock, Heart, Share2, ExternalLink } from 'lucide-react';

interface RecommendationCardProps {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  location?: string;
  distance?: string;
  openHours?: string;
  priceRange?: string;
  tags?: string[];
  isFavorite?: boolean;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onFavorite?: () => void;
  onShare?: () => void;
  variant?: 'horizontal' | 'vertical';
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  title,
  description,
  imageUrl,
  rating = 0,
  reviewCount = 0,
  location,
  distance,
  openHours,
  priceRange,
  tags = [],
  isFavorite = false,
  onPrimaryAction,
  onSecondaryAction,
  onFavorite,
  variant = 'vertical'
}) => {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : index < rating
            ? 'text-yellow-400 fill-current opacity-50'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  const cardContent = (
    <>
      {/* Image */}
      <div className={`relative overflow-hidden ${
        variant === 'horizontal' ? 'w-32 h-auto shrink-0' : 'h-32 w-full'
      }`}>
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={title}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            fill
            unoptimized
          />
        )}
        <button
          onClick={onFavorite}
          className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors hover:bg-white hover:text-red-500 z-10"
        >
          <Heart
            className={`w-4 h-4 ${
              isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'
            }`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">
            {title}
          </h3>
          {priceRange && (
            <span className="text-sm text-gray-600 ml-2">{priceRange}</span>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {description}
        </p>

        {/* Rating */}
        {rating > 0 && (
          <div className="flex items-center mb-2">
            <div className="flex items-center mr-2">
              {renderStars(rating)}
            </div>
            <span className="text-sm font-medium text-gray-700">
              {rating.toFixed(1)}
            </span>
            {reviewCount > 0 && (
              <span className="text-sm text-gray-500 ml-1">
                ({reviewCount})
              </span>
            )}
          </div>
        )}

        {/* Location and Hours */}
        <div className="space-y-1 mb-3">
          {location && (
            <div className="flex items-center text-xs text-gray-500">
              <MapPin className="w-3 h-3 mr-1" />
              <span>{location}</span>
              {distance && (
                <span className="ml-1 text-orange-600">{distance}</span>
              )}
            </div>
          )}
          {openHours && (
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              <span>{openHours}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="ui-chip bg-primary-50 text-primary-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onPrimaryAction}
            className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            前往
          </button>
          <button
            onClick={onSecondaryAction}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            <Share2 className="w-4 h-4 mr-1" />
            分享
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      className={`ui-card ${
        variant === 'horizontal' ? 'flex' : ''
      }`}
    >
      {cardContent}
    </div>
  );
};

export const RecommendationCardList: React.FC<{
  recommendations: RecommendationCardProps[];
  onCardAction?: (action: string, cardId: string) => void;
}> = ({ recommendations, onCardAction }) => {
  const handleAction = (action: string, cardId: string) => {
    onCardAction?.(action, cardId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">推薦給你</h2>
        <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
          查看更多
        </button>
      </div>
      
      <div className="grid gap-4">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            {...recommendation}
            onPrimaryAction={() => handleAction('go', recommendation.id)}
            onSecondaryAction={() => handleAction('share', recommendation.id)}
            onFavorite={() => handleAction('favorite', recommendation.id)}
            onShare={() => handleAction('share', recommendation.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default RecommendationCard;
