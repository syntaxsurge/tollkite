export default function Loading() {
  return (
    <div className='grid min-h-[60vh] place-items-center px-6'>
      <div className='flex flex-col items-center gap-4 text-center'>
        <div className='border-foreground/20 border-t-foreground h-10 w-10 animate-spin rounded-full border-2' />
        <p className='text-foreground/70 text-sm'>
          Preparing your workspace...
        </p>
      </div>
    </div>
  )
}
