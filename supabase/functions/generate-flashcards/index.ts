import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an educational assistant that creates flashcards from study notes. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: `Generate 3-5 educational flashcards from the following study notes. Each flashcard should have a clear question and a comprehensive answer that helps with learning and retention.

Study Notes:
${notes}

Create flashcards that:
1. Test key concepts and important facts
2. Use clear, specific questions
3. Provide detailed, helpful answers
4. Focus on the most important information

Return your response as a valid JSON object in this exact format:
{
  "flashcards": [
    {
      "question": "What is...",
      "answer": "The answer is..."
    }
  ]
}

Only return the JSON object, no additional text.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('Raw AI response:', generatedText);

    // Clean the response text
    let cleanedText = generatedText.trim();
    
    // Remove any potential markdown formatting
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\s*/, '').replace(/\s*```$/, '');
    }

    // Find the JSON object in the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate the response structure
    if (!parsedResponse.flashcards || !Array.isArray(parsedResponse.flashcards)) {
      throw new Error('Invalid response format: missing flashcards array');
    }

    // Validate each flashcard
    const validatedFlashcards = parsedResponse.flashcards.filter((card: any) => {
      return card.question && card.answer && 
             typeof card.question === 'string' && 
             typeof card.answer === 'string' &&
             card.question.trim().length > 0 &&
             card.answer.trim().length > 0;
    }).map((card: any) => ({
      question: card.question.trim(),
      answer: card.answer.trim()
    }));

    if (validatedFlashcards.length === 0) {
      throw new Error('No valid flashcards generated from the notes');
    }

    console.log(`Successfully generated ${validatedFlashcards.length} flashcards`);

    return new Response(
      JSON.stringify({ flashcards: validatedFlashcards }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
})