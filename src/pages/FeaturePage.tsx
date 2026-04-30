type FeaturePageProps = {
  title: string
  description: string
}

function FeaturePage({ title, description }: FeaturePageProps) {
  return (
    <section className="rounded-3xl border border-edge/40 bg-surface/80 p-8 shadow-[0_25px_60px_-35px_rgba(124,58,237,0.4)] backdrop-blur-md md:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pink">Coming Next</p>
      <h2 className="mt-3 text-3xl font-black text-ink md:text-4xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-ink md:text-lg">{description}</p>
      <p className="mt-8 inline-flex rounded-full bg-cta px-4 py-2 text-sm font-semibold text-white">
        Scaffolding ready for implementation
      </p>
    </section>
  )
}

export default FeaturePage
