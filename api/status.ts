import { GoogleAIFileManager } from "@google/generative-ai/server";

export const maxDuration = 60; // 일관성을 위해 60초 연장

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fileName, apiKey } = req.query;

  if (!fileName || !apiKey) {
    return res.status(400).json({ error: '🚨 필수 파라미터가 누락되었습니다.' });
  }

  try {
    const fileManager = new GoogleAIFileManager(apiKey);
    const file = await fileManager.getFile(fileName);
    
    return res.status(200).json({
      state: file.state,
      uri: file.uri,
      name: file.name
    });

  } catch (error: any) {
    console.error("🚨 [Backend Status Bridge Error]:", error);
    const status = error.message?.includes("429") ? 429 : 500;
    const msg = status === 429 
      ? "AI가 대용량 문서를 소화하느라 잠시 쉬고 있습니다. 1분 뒤에 질문해 주세요."
      : error.message || "Status Bridge Error";
    return res.status(status).json({ error: msg });
  }
}
