import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "InfiniStar — Chat with AI Characters"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #0f0a1e 0%, #1a0a3e 50%, #0d1a3a 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "80px",
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 32, color: "#a78bfa" }}>✦</div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.1,
          marginBottom: 24,
        }}
      >
        InfiniStar
      </div>
      <div
        style={{
          fontSize: 32,
          color: "#c4b5fd",
          lineHeight: 1.4,
          maxWidth: 800,
        }}
      >
        Chat with AI characters — anime heroes, fantasy companions, and creative personalities.
      </div>
      <div style={{ marginTop: 48, fontSize: 24, color: "#7c3aed" }}>infinistar.app</div>
    </div>,
    { ...size }
  )
}
