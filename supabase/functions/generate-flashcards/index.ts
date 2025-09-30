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

    console.log('Generating questions from notes...');
    
    // Step 1: Generate questions using T5 model
    const questionResults = await hf.textGeneration({
      model: 'mrm8488/t5-base-finetuned-question-generation-ap',
      inputs: `generate questions: ${notes}`,
      parameters: {
        max_new_tokens: 200,
        temperature: 0.7,
        return_full_text: false,
      },
    });

    console.log('Questions generated:', questionResults);

    // Extract questions from the response
    const generatedQuestions = questionResults.generated_text
      .split('\n')
      .filter((q: string) => q.trim().length > 0)
      .map((q: string) => q.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 5);

    if (generatedQuestions.length === 0) {
      throw new Error('No questions could be generated from the notes');
    }

    console.log('Processing questions:', generatedQuestions);

    // Step 2: Generate answers for each question using RoBERTa model
    const flashcards = [];
    
    for (const question of generatedQuestions) {
      try {
        console.log(`Generating answer for: ${question}`);
        
        const answerResult = await hf.questionAnswering({
          model: 'deepset/roberta-base-squad2',
          inputs: {
            question: question,
            context: notes,
          },
        });

        console.log('Answer generated:', answerResult);

        if (answerResult.answer && answerResult.answer.trim().length > 0) {
          flashcards.push({
            question: question,
            answer: answerResult.answer.trim(),
          });
        }
      } catch (error) {
        console.error(`Error generating answer for question "${question}":`, error);
        // Continue with other questions even if one fails
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