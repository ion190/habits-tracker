import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import Modal from './Modal'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export default function ModalPortal({ title, onClose, children, width = 520 }: Props) {
  return createPortal(
    <Modal title={title} onClose={onClose} width={width}>
      {children}
    </Modal>,
    document.body
  )
}

