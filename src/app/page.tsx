import Link from 'next/link'

export default function HomePage() {
    return (
        <div className="page">
            <div className="container container--narrow" style={{ textAlign: 'center' }}>
                <div className="page__header">
                    <h1 className="page__title">⚽ El Contragolpe</h1>
                    <p className="page__subtitle">
                        Football prediction game — play from your table!
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <Link href="/join" className="btn btn--primary btn--lg btn--full">
                        🎮 Join Game
                    </Link>
                    <Link href="/admin" className="btn btn--secondary btn--lg btn--full">
                        🔧 Admin Dashboard
                    </Link>
                </div>
            </div>
        </div>
    )
}
