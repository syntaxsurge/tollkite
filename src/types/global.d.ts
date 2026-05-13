declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.mdx' {
  const MDXComponent: (props: Record<string, unknown>) => JSX.Element
  export default MDXComponent
}
