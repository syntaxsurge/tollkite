export default function AppLoading() {
  return (
    <div className='space-y-6'>
      <div className='border-foreground/10 bg-muted h-40 animate-pulse rounded-lg border' />
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className='border-foreground/10 bg-muted h-28 animate-pulse rounded-lg border'
          />
        ))}
      </div>
      <div className='border-foreground/10 bg-muted h-72 animate-pulse rounded-lg border' />
    </div>
  )
}
