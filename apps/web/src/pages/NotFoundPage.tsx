import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { PageState } from "../components/PageState.js";

export function NotFoundPage() {
  return (
    <PageState
      tone="empty"
      title="页面不存在"
      action={
        <Link className="primary-button state-action" to="/">
          <ArrowLeft size={18} />
          返回首页
        </Link>
      }
    >
      这个链接可能已经失效，或房间邀请地址不完整。
    </PageState>
  );
}
