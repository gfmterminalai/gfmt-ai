import type { AppProps } from 'next/app'
import '../styles/globals.scss'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="font-use-geist-mono">
      <Component {...pageProps} />
    </div>
  )
} 