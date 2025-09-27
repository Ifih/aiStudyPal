import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { notes } = await req.json()

    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      throw new Error('Notes are required and must be a non-empty string')
    }

    // Limit notes length to prevent abuse
    if (notes.length > 5000) {
      throw new Error('Notes must be less than 5000 characters')
    }

    console.log('Generating flashcards for notes:', notes.substring(0, 100) + '...')

    const hf = new HfInference(Deno.env.get('HUGGING_FACE_ACCESS_TOKEN'))

    const prompt = `Generate 3-5 educational flashcards from the following study notes. Each flashcard should have a clear question and a comprehensive answer that helps with learning and retention.

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

    const response = await hf.textGeneration({
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false,
      }
    })

    console.log('Raw AI response:', response.generated_text)

    // Clean the response text
    let cleanedText = response.generated_text.trim()
    
    // Remove any potential markdown formatting
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\s*/, '').replace(/\s*```$/, '')
    }

    // Find the JSON object in the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response')
    }

    let parsedResponse
    try {
      parsedResponse = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Validate the response structure
    if (!parsedResponse.flashcards || !Array.isArray(parsedResponse.flashcards)) {
      throw new Error('Invalid response format: missing flashcards array')
    }

    // Validate each flashcard
    const validatedFlashcards = parsedResponse.flashcards.filter((card: any) => {
      return card.question && card.answer && 
             typeof card.question === 'string' && 
             typeof card.answer === 'string' &&
             card.question.trim().length > 0 &&
             card.answer.trim().length > 0
    }).map((card: any) => ({
      question: card.question.trim(),
      answer: card.answer.trim()
    }))

    if (validatedFlashcards.length === 0) {
      throw new Error('No valid flashcards generated from the notes')
    }

    console.log(`Successfully generated ${validatedFlashcards.length} flashcards`)

    return new Response(
      JSON.stringify({ flashcards: validatedFlashcards }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in generate-flashcards function:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to generate flashcards from the provided notes'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})