# 37. Nano Banana

We'll swap the models used in the `AiImageNode.svelte` to use Google's latest Nano Banana model instead, for image generation and image editing.

Refer to `AiTextNode.svelte` on how to accept images as input.

## Code Samples

Image Generation (Text to Image)

```ts
import {GoogleGenAI, Modality} from '@google/genai'
import * as fs from 'node:fs'

async function main() {
  const ai = new GoogleGenAI({})

  const prompt =
    'Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme'

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: prompt,
  })
  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text)
    } else if (part.inlineData) {
      const imageData = part.inlineData.data
      const buffer = Buffer.from(imageData, 'base64')
      fs.writeFileSync('gemini-native-image.png', buffer)
      console.log('Image saved as gemini-native-image.png')
    }
  }
}

main()
```

Image Editing (Image to Image)

```ts
import {GoogleGenAI, Modality} from '@google/genai'
import * as fs from 'node:fs'

async function main() {
  const ai = new GoogleGenAI({})

  const imagePath = 'path/to/cat_image.png'
  const imageData = fs.readFileSync(imagePath)
  const base64Image = imageData.toString('base64')

  const prompt = [
    {
      text:
        'Create a picture of my cat eating a nano-banana in a' +
        'fancy restaurant under the Gemini constellation',
    },
    {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image,
      },
    },
  ]

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: prompt,
  })
  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text)
    } else if (part.inlineData) {
      const imageData = part.inlineData.data
      const buffer = Buffer.from(imageData, 'base64')
      fs.writeFileSync('gemini-native-image.png', buffer)
      console.log('Image saved as gemini-native-image.png')
    }
  }
}

main()
```
