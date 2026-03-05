<template>
  <div class="app-shell">
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100dvh;
  min-height: 100dvh;
  width: min(1400px, calc(100vw - 20px));
  margin: 0 auto;
  padding-top: 10px;
  padding-bottom: 12px;
  overflow: hidden;
}

@media (max-width: 980px) {
  .app-shell {
    height: auto;
    min-height: 100vh;
    width: min(1400px, calc(100vw - 16px));
    padding-top: 10px;
    padding-bottom: 16px;
    overflow: visible;
  }
}
</style>
