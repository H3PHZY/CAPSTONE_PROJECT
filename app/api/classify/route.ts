import { NextResponse } from "next/server";
import { classifyListingImage } from "@/lib/classify";

export const runtime = "nodejs";

type Body = {
  imageUrl?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim();
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  try {
    // Only allow classifying photos from our Supabase storage / project URL
    const allowedHosts = [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.PROJECT_URL,
    ]
      .filter(Boolean)
      .map((u) => {
        try {
          return new URL(u as string).host;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];

    const host = new URL(imageUrl).host;
    if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
      return NextResponse.json(
        { error: "imageUrl must be an EcoLoop listing photo URL" },
        { status: 400 }
      );
    }

    const result = await classifyListingImage(imageUrl);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed";
    const status =
      message.includes("Missing HF_") || message.includes("HF_TOKEN") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
