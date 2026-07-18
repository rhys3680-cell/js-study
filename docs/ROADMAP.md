# 로드맵

프레임워크 없이 구현하며 프론트엔드 이해도를 높이는 프로젝트.

**진행 순서**: 네트워크 → 프론트엔드

---

## 폴더 구조

```
js-study/
├── package.json          루트. npm scripts로 실행 명령 관리
├── README.md
└── docs/
    ├── ROADMAP.md        ← 이 파일. 현재 위치와 다음 할 일
    └── interview.md      면접 키워드
```

**왜 npm workspaces가 아닌가**: 외부 의존성 0
패키지끼리 참조하거나 의존성이 다를 때 도입
WebSocket 단계에서 `ws`를 비교용으로 쓰게 되면 도입 검토
