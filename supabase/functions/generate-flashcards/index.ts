import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { notes } = await req.json();

    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      throw new Error('Notes are required and must be a non-empty string');
    }

    // Limit notes length to prevent abuse
    if (notes.length > 5000) {
      throw new Error('Notes must be less than 5000 characters');
    }

    console.log('Generating flashcards for notes:', notes.substring(0, 100) + '...');

    const huggingFaceApiKey = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!huggingFaceApiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    const hf = new HfInference(huggingFaceApiKey);

    console.log('Using simpler approach: generating Q&A pairs from notes...');
    
    // Use a simpler approach: extract key information and create flashcards
    // Split notes into sentences and create Q&A pairs
    const sentences = notes
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200);

    if (sentences.length === 0) {
      throw new Error('Notes are too short or improperly formatted');
    }

    console.log(`Found ${sentences.length} sentences to process`);

    // For each sentence, try to generate a question and answer
    const flashcards = [];
    const maxCards = Math.min(5, sentences.length);

    for (let i = 0; i < maxCards; i++) {
      const sentence = sentences[i];
      
      try {
        console.log(`Processing sentence ${i + 1}: "${sentence.substring(0, 50)}..."`);
        
        // Use the question-answering model to extract key information
        // First, create a simple question based on the sentence
        const simpleQuestion = `What is this about?`;
        
        const qaResult = await hf.questionAnswering({
          model: 'deepset/roberta-base-squad2',
          inputs: {
            question: simpleQuestion,
            context: sentence,
          },
        });

        console.log('QA result:', qaResult);

        if (qaResult.answer && qaResult.answer.trim().length > 0) {
          // Create a more natural question based on the answer
          const answer = qaResult.answer.trim();
          
          // Create questions based on the answer type
          let question;
          if (sentence.toLowerCase().includes('what is') || sentence.toLowerCase().includes('what are')) {
            // Extract the subject from sentences that define things
            const match = sentence.match(/(?:What is|What are)\s+([^?]+)/i);
            question = match ? `What is ${match[1].trim()}?` : `What is ${answer}?`;
          } else if (sentence.toLowerCase().includes('how')) {
            question = `How ${sentence.split(/how/i)[1]?.split(/[.!?]/)[0]?.trim()}?` || `What is the explanation?`;
          } else if (sentence.toLowerCase().includes('when')) {
            question = `When ${sentence.split(/when/i)[1]?.split(/[.!?]/)[0]?.trim()}?` || `When does this occur?`;
          } else if (sentence.toLowerCase().includes('where')) {
            question = `Where ${sentence.split(/where/i)[1]?.split(/[.!?]/)[0]?.trim()}?` || `Where is this located?`;
          } else if (sentence.toLowerCase().includes('who')) {
            question = `Who ${sentence.split(/who/i)[1]?.split(/[.!?]/)[0]?.trim()}?` || `Who is involved?`;
          } else {
            // For declarative sentences, create a "What is/are" question
            question = `What is ${answer}?`;
          }
          
          flashcards.push({
            question: question,
            answer: answer,
          });
          
          console.log(`Created flashcard ${i + 1}: Q: "${question}" A: "${answer}"`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing sentence ${i + 1}:`, errorMsg);
        // Continue with next sentence
      }
    }

    if (flashcards.length === 0) {
      throw new Error('No valid flashcards could be generated from the notes');
    }

    console.log(`Successfully generated ${flashcards.length} flashcards`);

    return new Response(
      JSON.stringify({ flashcards }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-flashcards function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to generate flashcards from the provided notes using Hugging Face'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
})