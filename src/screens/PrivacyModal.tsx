import { createPortal } from "react-dom";

export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="memberDialogBackdrop" onClick={onClose}>
      <div
        className="privacyModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="プライバシーポリシー"
      >
        <div className="privacyModalHead">
          <h2 className="privacyModalTitle">プライバシーポリシー</h2>
          <button type="button" className="privacyModalClose" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="privacyModalBody">
          <p>narabi（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。</p>

          <h3>収集する情報</h3>
          <p>本サービスは、ユーザーが「共有リンク」機能を使用した場合に、作成した並び順データ（メンバー名・パート・配置）をGoogleのFirebase Firestoreに保存します。氏名・メールアドレス・位置情報などの個人情報は収集しません。</p>

          <h3>利用目的</h3>
          <p>保存したデータは、共有リンクを通じた閲覧・同期のためのみに使用します。第三者への提供や広告目的での利用は行いません。</p>

          <h3>第三者サービス</h3>
          <p>本サービスはGoogle Firebase（Firestore）を使用しています。Googleのプライバシーポリシーについては <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">こちら</a> をご確認ください。</p>

          <h3>データの削除</h3>
          <p>共有リンクの削除やデータに関するご要望は、下記お問い合わせ先までご連絡ください。</p>

          <h3>お問い合わせ</h3>
          <p>
            <a href="mailto:viva.vital.voice@gmail.com" className="privacyMailLink">
              viva.vital.voice@gmail.com
            </a>
          </p>

          <p className="privacyModalDate">制定日：2026年8月29日</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
