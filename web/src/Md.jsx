import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

// 한글 문서에서 "**강조**로" 처럼 닫는 ** 바로 뒤에 글자가 붙으면 CommonMark가 강조로 인식하지 않는다.
// 렌더링 전에 **…** 를 <strong>으로 바꿔 두고 rehype-raw로 그린다.
export function fixMd(md) {
  if (!md) return ''
  return md.replace(/\*\*\s*([^*\n]+?)\s*\*\*/g, '<strong>$1</strong>')
}

const plugins = { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeRaw] }

export default function Md({ children, className = 'md' }) {
  return (
    <div className={className}>
      <ReactMarkdown {...plugins}>{fixMd(children)}</ReactMarkdown>
    </div>
  )
}

const inlineComponents = {
  p: ({ children }) => <>{children}</>,
}

// 문제 지문·선택지·해설처럼 한 덩어리 텍스트용 (p 태그 없이 인라인으로)
export function MdInline({ children }) {
  return (
    <ReactMarkdown {...plugins} components={inlineComponents}>
      {fixMd(children)}
    </ReactMarkdown>
  )
}
