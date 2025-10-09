import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Sparkles, Clock, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Landing() {
  const { enterGuestMode } = useAuth();
  const navigate = useNavigate();

  const handleGuestMode = () => {
    enterGuestMode();
    navigate('/dashboard');
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Transform Your Notes Into Interactive Flashcards
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Leverage AI to convert your study notes into engaging, interactive flashcards. 
              Study smarter, retain more, and ace your exams with personalized learning materials.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="text-lg px-8 py-3">
                  Get Started Free
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="lg"
                className="text-lg px-8 py-3"
                onClick={handleGuestMode}
              >
                Try as Guest
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose AI Study Pal?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>AI-Powered Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Advanced AI analyzes your notes and creates relevant questions and answers automatically.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Interactive Learning</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Flip cards with smooth animations to test your knowledge and improve retention.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Save Time</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  No more manual flashcard creation. Generate dozens of cards in seconds from your notes.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Personalized</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Each flashcard set is tailored to your specific notes and learning materials.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Revolutionize Your Study Routine?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of students who are already studying smarter with AI-generated flashcards.
          </p>
          <Link to="/signup">
            <Button size="lg" className="text-lg px-8 py-3">
              Start Learning Today
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}