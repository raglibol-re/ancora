import { useId } from "react";
import styles from "./Segmented.module.css";

type SegmentedProps<T extends string> = {
	label: string;
	options: readonly { value: T; label: string; count?: number }[];
	value: T;
	onChange: (value: T) => void;
};

/** Native radio buttons styled as a segmented control (filters, theme choice). */
export function Segmented<T extends string>({
	label,
	options,
	value,
	onChange,
}: SegmentedProps<T>) {
	const name = useId();
	return (
		<fieldset className={styles.group}>
			<legend className={styles.legend}>{label}</legend>
			{options.map((option) => (
				<label key={option.value} className={styles.option}>
					<input
						type="radio"
						name={name}
						value={option.value}
						checked={option.value === value}
						onChange={() => onChange(option.value)}
					/>
					{option.label}
					{option.count !== undefined && <span className={styles.count}>{option.count}</span>}
				</label>
			))}
		</fieldset>
	);
}
