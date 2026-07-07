import { storage } from "./storage.js";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

/* ============================================================
   백엔드 추상화
   - Supabase 설정 시  : 이메일 로그인 + 공유 DB(erp_state) + Realtime
   - 미설정 시          : localStorage (기존 단일 기기 동작)
   화면(App)은 이 모듈만 호출하고 모드 차이를 신경 쓰지 않습니다.
   ============================================================ */

export const mode = isSupabaseConfigured ? "supabase" : "local";

const STATE_ID = "main"; // 단일 회사 → 고정 행 하나

/* 테이블이 아직 생성되지 않았을 때 구분하기 위한 에러 코드 */
export const TABLE_MISSING = "TABLE_MISSING";

/* ---------- 인증 ---------- */

export const auth = {
  /* 현재 세션 (로컬 모드는 항상 로그인된 것으로 간주) */
  async getSession() {
    if (mode === "local") return { local: true };
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /* 세션 변경 구독 → 구독 해제 함수 반환 */
  onChange(cb) {
    if (mode === "local") return () => {};
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // 이메일 확인이 꺼져 있으면 즉시 세션이 생기고, 켜져 있으면 확인 메일 필요
    return { needsConfirm: !data.session };
  },

  async signOut() {
    if (mode === "local") return;
    await supabase.auth.signOut();
  },

  async currentUserId() {
    if (mode === "local") return null;
    const { data } = await supabase.auth.getUser();
    return data.user ? data.user.id : null;
  },
};

/* ---------- 상태 저장/불러오기 ---------- */

export const store = {
  /* 저장된 ERP 상태를 반환 (없으면 null → 설정 마법사) */
  async getState() {
    if (mode === "local") {
      const r = await storage.get("erp:state");
      return r && r.value ? JSON.parse(r.value) : null;
    }
    const { data, error } = await supabase
      .from("erp_state")
      .select("data")
      .eq("id", STATE_ID)
      .maybeSingle();
    if (error) {
      // 테이블 미생성 → 설정 안내를 띄운다
      // PostgREST: PGRST205(스키마 캐시에 테이블 없음) / Postgres: 42P01
      if (
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        /relation .* does not exist/i.test(error.message || "") ||
        /Could not find the table/i.test(error.message || "")
      ) {
        const e = new Error("erp_state 테이블이 없습니다");
        e.code = TABLE_MISSING;
        throw e;
      }
      throw error;
    }
    return data ? data.data : null;
  },

  /* 전체 상태 저장 (upsert) */
  async setState(obj) {
    if (mode === "local") {
      await storage.set("erp:state", JSON.stringify(obj));
      return;
    }
    const updated_by = await auth.currentUserId();
    const { error } = await supabase
      .from("erp_state")
      .upsert({ id: STATE_ID, data: obj, updated_by }, { onConflict: "id" });
    if (error) throw error;
  },

  async deleteState() {
    if (mode === "local") {
      await storage.delete("erp:state");
      return;
    }
    const { error } = await supabase.from("erp_state").delete().eq("id", STATE_ID);
    if (error) throw error;
  },

  /* 다른 사용자의 저장을 Realtime 으로 수신 → 구독 해제 함수 반환.
     cb(newState) 형태로 파싱된 상태 객체를 전달한다.
     Realtime 은 RLS 를 적용하므로 소켓에 로그인 토큰을 반드시 실어야 이벤트가 전달된다. */
  subscribe(cb) {
    if (mode === "local") return () => {};
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
    });
    const ch = supabase
      .channel("erp_state_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "erp_state", filter: `id=eq.${STATE_ID}` },
        (payload) => {
          if (payload.eventType === "DELETE") cb(null);
          else if (payload.new && payload.new.data) cb(payload.new.data);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  },
};
