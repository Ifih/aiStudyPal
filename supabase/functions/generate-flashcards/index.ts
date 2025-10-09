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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    console.log('Using Gemini AI 2.5 to generate flashcards...');

    // Call Lovable AI Gateway with Gemini 2.5
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful study assistant that creates flashcards from study notes. Generate 5-7 high-quality question-answer pairs that test understanding of key concepts.'
          },
          {
            role: 'user',
            content: `Create flashcards from these study notes. For each flashcard, provide a clear question and a concise answer. Focus on the most important concepts.\n\nStudy Notes:\n${notes}\n\nGenerate 5-7 flashcards in JSON format as an array with objects containing "question" and "answer" fields.`
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Please try again in a moment.',
            details: 'Too many requests to the AI service.'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 429 
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'AI service requires payment. Please add credits to your workspace.',
            details: 'Visit Settings -> Workspace -> Usage to add credits.'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 402 
          }
        );
      }
      const errorText = await response.text();
      console.error('Gemini AI error:', response.status, errorText);
      throw new Error('Failed to generate flashcards using Gemini AI');
    }

    const aiResponse = await response.json();
    console.log('AI response received');

    // Parse the AI response
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Invalid response from AI service');
    }

    let flashcards;
    try {
      const parsed = JSON.parse(content);
      flashcards = parsed.flashcards || parsed.cards || parsed;
      
      if (!Array.isArray(flashcards)) {
        throw new Error('AI response is not in the expected format');
      }

      // Validate flashcard structure
      flashcards = flashcards
        .filter((card: any) => card.question && card.answer)
        .map((card: any) => ({
          question: String(card.question).trim(),
          answer: String(card.answer).trim(),
        }));

      if (flashcards.length === 0) {
        throw new Error('No valid flashcards could be extracted from AI response');
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse flashcards from AI response');
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
        details: 'Failed to generate flashcards from the provided notes using Gemini AI'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
})