import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HfInference } from 'npm:@huggingface/inference@2.8.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Flashcard {
  question: string;
  answer: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { notes } = await req.json();

    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Notes are required and must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (notes.length > 5000) {
      return new Response(
        JSON.stringify({ error: `Notes must be less than 5000 characters. Current length: ${notes.length}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating flashcards for notes:', notes.substring(0, 100) + '...');

    const huggingFaceApiKey = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!huggingFaceApiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    const hf = new HfInference(huggingFaceApiKey);

    console.log('Using multi-model approach: dedicated models for questions and answers...');

    const chunks = notes
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30);

    if (chunks.length === 0) {
      throw new Error('Notes are too short or improperly formatted');
    }

    console.log(`Found ${chunks.length} text segments to process`);

    const flashcards: Flashcard[] = [];
    const maxCards = Math.min(5, chunks.length);
    const processedChunks = new Set<string>();

    for (let i = 0; i < maxCards && flashcards.length < maxCards; i++) {
      const chunk = chunks[i];

      if (processedChunks.has(chunk) || chunk.length < 30) {
        continue;
      }

      try {
        console.log(`Processing chunk ${i + 1}/${maxCards}: "${chunk.substring(0, 50)}..."`);

        const questionPrompt = `Generate a clear, specific study question based on this information. Only output the question, nothing else:\n\n${chunk}`;

        console.log('Generating question with text-generation model...');
        const questionResult = await hf.textGeneration({
          model: 'mistralai/Mistral-7B-Instruct-v0.2',
          inputs: questionPrompt,
          parameters: {
            max_new_tokens: 100,
            temperature: 0.7,
            top_p: 0.9,
            return_full_text: false,
          },
        });

        let generatedQuestion = questionResult.generated_text.trim();

        generatedQuestion = generatedQuestion
          .split('\n')[0]
          .replace(/^(Question:|Q:|Answer:|A:)\s*/i, '')
          .trim();

        if (!generatedQuestion.endsWith('?')) {
          generatedQuestion += '?';
        }

        console.log('Generated question:', generatedQuestion);

        console.log('Generating answer with question-answering model...');
        const answerResult = await hf.questionAnswering({
          model: 'deepset/roberta-large-squad2',
          inputs: {
            question: generatedQuestion,
            context: chunk,
          },
        });

        let answer = answerResult.answer.trim();

        if (answer.length < 10) {
          console.log('Answer too short, using chunk as context...');
          answer = chunk;
        }

        if (answer.length > 200) {
          answer = answer.substring(0, 197) + '...';
        }

        console.log('Generated answer:', answer);

        if (generatedQuestion.length > 15 && answer.length > 10) {
          flashcards.push({
            question: generatedQuestion,
            answer: answer,
          });

          processedChunks.add(chunk);
          console.log(`Created flashcard ${flashcards.length}: Q: "${generatedQuestion}" A: "${answer}"`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing chunk ${i + 1}:`, errorMsg);
      }
    }

    if (flashcards.length === 0) {
      throw new Error('No valid flashcards could be generated from the notes');
    }

    console.log(`Successfully generated ${flashcards.length} flashcards`);

    return new Response(
      JSON.stringify({ flashcards }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error in generate-flashcards function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: 'Failed to generate flashcards from the provided notes'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});