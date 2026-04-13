<script lang="ts">
  import type { ExtensionPack } from '../../../stores/extensions.store';
  import PackCard from './PackCard.svelte';

  let {
    pack,
    enabled,
    onToggle,
    searchQuery = '',
    locked = false,
    variant = 'row' as 'row' | 'tile',
    selected = false,
    onSelect
  }: {
    pack: ExtensionPack;
    enabled: boolean;
    onToggle: () => void;
    searchQuery?: string;
    locked?: boolean;
    variant?: 'row' | 'tile';
    selected?: boolean;
    onSelect?: () => void;
  } = $props();
</script>

<PackCard
  name={pack.name}
  description={pack.description}
  icon={pack.icon}
  items={pack.objects}
  {enabled}
  {onToggle}
  {searchQuery}
  {locked}
  {variant}
  {selected}
  {onSelect}
/>
