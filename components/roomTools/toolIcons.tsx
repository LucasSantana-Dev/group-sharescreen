import type { ReactNode } from "react";
import {
  MdCalculate,
  MdChecklist,
  MdCode,
  MdDescription,
  MdEmojiEmotions,
  MdGesture,
  MdNotes,
  MdOutlineDraw,
  MdPoll,
  MdTableChart,
} from "react-icons/md";
import { PiSpinnerBallBold } from "react-icons/pi";
import type { ToolKind } from "@/lib/roomTools";

export const TOOL_ICONS: Record<ToolKind, ReactNode> = {
  whiteboard: <MdOutlineDraw />,
  notepad: <MdNotes />,
  annotate: <MdGesture />,
  poll: <MdPoll />,
  reactions: <MdEmojiEmotions />,
  code: <MdCode />,
  tasks: <MdChecklist />,
  sheet: <MdTableChart />,
  doc: <MdDescription />,
  wheel: <PiSpinnerBallBold />,
  calc: <MdCalculate />,
};
