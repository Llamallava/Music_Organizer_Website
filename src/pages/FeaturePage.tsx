type FeaturePageProps = {
  title: string
  description: string
}

function FeaturePage({ title, description }: FeaturePageProps) {
  return (
    <section className="rounded-3xl border border-white/35 bg-white/75 p-8 shadow-[0_25px_60px_-35px_rgba(18,38,63,0.5)] backdrop-blur-md md:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Coming Next</p>
      <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-slate-700 md:text-lg">{description}</p>
      <p className="mt-8 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
        Scaffolding ready for implementation
      </p>
    </section>
  )
}

export default FeaturePage
