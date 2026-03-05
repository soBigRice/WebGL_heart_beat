<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ThreeScene } from '../webgl/ThreeScene';

const webglContainer = ref<HTMLElement | null>(null);
let threeScene: ThreeScene | null = null;

onMounted(() => {
  if (webglContainer.value) {
    threeScene = new ThreeScene(webglContainer.value);
  }
});

onUnmounted(() => {
  if (threeScene) {
    threeScene.destroy();
    threeScene = null;
  }
});
</script>

<template>
  <div id="webgl-container" ref="webglContainer"></div>
</template>

<style scoped>
#webgl-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
}
</style>
