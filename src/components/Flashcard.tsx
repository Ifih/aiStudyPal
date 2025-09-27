import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2 } from 'lucide-react';

interface FlashcardProps {
  id: string;
  question: string;
  answer: string;
  notes?: string;
  onDelete?: (id: string) => void;
}

export function Flashcard({ id, question, answer, notes, onDelete }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <div className="flip-card w-full h-64 cursor-pointer" onClick={handleFlip}>
      <div className={`flip-card-inner h-full relative ${isFlipped ? 'flipped' : ''}`}>
        {/* Front of the card */}
        <Card className="flip-card-front absolute inset-0 h-full hover:shadow-lg transition-shadow">
          <CardContent className="flex flex-col items-center justify-center h-full p-6 text-center">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Question</h3>
            <p className="text-muted-foreground leading-relaxed">{question}</p>
            <div className="absolute bottom-4 right-4">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Back of the card */}
        <Card className="flip-card-back absolute inset-0 h-full hover:shadow-lg transition-shadow bg-secondary/20">
          <CardContent className="flex flex-col items-center justify-center h-full p-6 text-center relative">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Answer</h3>
            <p className="text-foreground leading-relaxed font-medium">{answer}</p>
            {notes && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground italic">From: {notes}</p>
              </div>
            )}
            <div className="absolute bottom-4 right-4 flex space-x-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="p-1 h-auto"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}