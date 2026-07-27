import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "InfiniStar — Chat with AI Characters"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  const headingFont = await fetch(
    new URL("./fonts/bricolage-grotesque-bold.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer())

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "80px",
        backgroundColor: "#0a0710",
        backgroundImage:
          "radial-gradient(720px 480px at 12% 0%, rgba(124, 58, 237, 0.45), transparent 68%), " +
          "radial-gradient(640px 420px at 88% 10%, rgba(192, 38, 211, 0.35), transparent 66%), " +
          "radial-gradient(520px 380px at 70% 100%, rgba(244, 63, 94, 0.22), transparent 70%)",
      }}
    >
      <svg
        width="88"
        height="88"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#c4b5fd"
          d="M10.5 1.5c.87 5.1 4.53 8.76 9.63 9.63-5.1.87-8.76 4.53-9.63 9.63-.87-5.1-4.53-8.76-9.63-9.63 5.1-.87 8.76-4.53 9.63-9.63Z"
        />
        <path
          fill="#f0abfc"
          opacity="0.8"
          d="M18.75 14.25c.4 2.36 2.14 4.1 4.5 4.5-2.36.4-4.1 2.14-4.5 4.5-.4-2.36-2.14-4.1-4.5-4.5 2.36-.4 4.1-2.14 4.5-4.5Z"
        />
      </svg>
      <div
        style={{
          marginTop: 36,
          fontSize: 84,
          fontWeight: 700,
          fontFamily: "Bricolage Grotesque",
          color: "#ffffff",
          lineHeight: 1.05,
          letterSpacing: "-2px",
        }}
      >
        InfiniStar
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 34,
          color: "#d8cdf5",
          lineHeight: 1.4,
          maxWidth: 860,
        }}
      >
        Characters worth coming back to — roleplay, romance, tutoring, and worldbuilding, powered by
        Claude.
      </div>
      <div style={{ marginTop: 48, fontSize: 26, color: "#a78bfa" }}>infinistar.app</div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Bricolage Grotesque",
          data: headingFont,
          weight: 700,
          style: "normal",
        },
      ],
    }
  )
}
