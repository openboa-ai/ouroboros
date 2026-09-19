// Product SDK build entry; consumers receive bundled exports, not application imports.
import '../../apps/mac/src/ui/styles.css';
export * from '../../apps/mac/src/ui/components/patterns';
export {Button} from '../../apps/mac/src/ui/primitives/button';
export {Tabs,TabsList,TabsTrigger,TabsContent} from '../../apps/mac/src/ui/primitives/tabs';
export {Input} from '../../apps/mac/src/ui/primitives/input';
export {TooltipProvider} from '../../apps/mac/src/ui/primitives/tooltip';
