import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'El Contragolpe — Football Prediction Game',
    description: 'Make predictions on live football matches and compete with your restaurant table!',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
                <meta name="theme-color" content="#0a0f1c" />
            </head>
            <body>{children}</body>
        </html>
    )
}
