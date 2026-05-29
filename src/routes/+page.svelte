<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { todayKey } from '$lib/utils/date';
  import { onMount } from 'svelte';
  onMount(() => goto(`${base}/day/${todayKey()}`, { replaceState: true }));
</script>

<p>Lade…</p>
