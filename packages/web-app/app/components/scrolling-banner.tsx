export function ScrollingBanner({ text }: { text: string }) {
  // Duplicate the text to create a seamless loop
  const repeatedText = `${text} • ${text}`

  return (
    <div className="scrolling-banner">
      <div className="scrolling-text">{repeatedText}</div>
    </div>
  )
} 