import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Flashcard } from '@/components/Flashcard';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, History, PlusCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface FlashcardData {
  id: string;
  question: string;
  answer: string;
  notes?: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [flashcards, setFlashcards] = useState<FlashcardData[]>([]);
  const [loadingFlashcards, setLoadingFlashcards] = useState(true);
  const [error, setError] = useState('');

  // Redirect if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/signin" replace />;
  }

  // Load existing flashcards
  useEffect(() => {
    if (user) {
      loadFlashcards();
    }
  }, [user]);

  const loadFlashcards = async () => {
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFlashcards(data || []);
    } catch (error) {
      console.error('Error loading flashcards:', error);
      toast({
        title: "Error loading flashcards",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoadingFlashcards(false);
    }
  };

  const generateFlashcards = async () => {
    if (!notes.trim()) {
      setError('Please enter some notes to generate flashcards.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: { notes: notes.trim() }
      });

      if (error) throw error;

      if (data?.flashcards && Array.isArray(data.flashcards)) {
        // Save generated flashcards to database
        const flashcardsToSave = data.flashcards.map((card: any) => ({
          user_id: user?.id,
          question: card.question,
          answer: card.answer,
          notes: notes.trim(),
        }));

        const { data: savedCards, error: saveError } = await supabase
          .from('flashcards')
          .insert(flashcardsToSave)
          .select();

        if (saveError) throw saveError;

        // Update local state with new flashcards
        setFlashcards([...savedCards, ...flashcards]);
        setNotes('');
        
        toast({
          title: "Flashcards generated successfully!",
          description: `Generated ${data.flashcards.length} flashcards from your notes.`,
        });
      } else {
        throw new Error('Invalid response format from AI service');
      }
    } catch (error: any) {
      console.error('Error generating flashcards:', error);
      setError(error.message || 'Failed to generate flashcards. Please try again.');
      toast({
        title: "Generation failed",
        description: "Please check your notes and try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const deleteFlashcard = async (id: string) => {
    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFlashcards(flashcards.filter(card => card.id !== id));
      toast({
        title: "Flashcard deleted",
        description: "The flashcard has been removed.",
      });
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete the flashcard.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || loadingFlashcards) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Your Study Dashboard</h1>
          
          {/* Generate Flashcards Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <PlusCircle className="h-5 w-5 mr-2" />
                Generate New Flashcards
              </CardTitle>
              <CardDescription>
                Paste your study notes below and let AI create interactive flashcards for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="notes">Your Study Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Paste your notes here. The AI will analyze them and create relevant question-answer pairs for your flashcards..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={generating}
                  className="min-h-[150px]"
                />
              </div>
              
              <Button 
                onClick={generateFlashcards}
                disabled={generating || !notes.trim()}
                size="lg"
                className="w-full sm:w-auto"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Flashcards...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Flashcards
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Flashcards History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="h-5 w-5 mr-2" />
                Your Flashcards ({flashcards.length})
              </CardTitle>
              <CardDescription>
                Click on any card to flip between question and answer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flashcards.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No flashcards yet</h3>
                  <p className="text-muted-foreground">
                    Generate your first set of flashcards by entering your study notes above.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {flashcards.map((flashcard) => (
                    <Flashcard
                      key={flashcard.id}
                      id={flashcard.id}
                      question={flashcard.question}
                      answer={flashcard.answer}
                      notes={flashcard.notes}
                      onDelete={deleteFlashcard}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}