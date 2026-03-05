<template>
  <div class="app-shell">
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  width: min(1400px, calc(100vw - 24px));
  margin: 0 auto;
  padding-top: 14px;
  padding-bottom: 24px;
}

@media (max-width: 760px) {
  .app-shell {
    width: min(1400px, calc(100vw - 16px));
    padding-top: 10px;
  }
}
</style>
